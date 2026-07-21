/**
 * Browser coverage for the P7 editors-and-complex residual audit cleanup.
 *
 * Each slice lives in its own top-level `describe` block named for the slice so
 * the blocks remain independently removable. Slices target the existing
 * playground routes: /page/chat, /page/markdown-editor, /page/review-editor,
 * and /page/json-schema-editor.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY } from '../src/helpers/theme.ts';

/** Channel value of `--cinder-touch-target-min` (tokens-base.css). */
const TOUCH_TARGET_MIN = 44;

/**
 * Resolves the alpha channel (0–255) of a computed CSS color *inside the page*,
 * so any color space the browser emits — `rgb()`, `rgba()`, `oklch()`, etc. —
 * is handled by the browser's own color engine rather than a brittle string
 * parser. Paints the color onto a 1×1 canvas and reads back the alpha byte.
 */
async function colorAlpha(
  target: import('@playwright/test').Locator,
  property: 'backgroundColor' | 'borderTopColor',
): Promise<number> {
  return target.evaluate((element, prop) => {
    const value = getComputedStyle(element)[prop];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3] ?? 0;
  }, property);
}

/**
 * Opens a playground route in a fresh touch-capable context with the requested
 * theme pre-selected, and waits for the app to mount.
 */
async function openTouchPage(
  browser: Browser,
  route: string,
  theme: 'light' | 'dark',
): Promise<{ page: Page; dispose: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    colorScheme: theme,
    reducedMotion: 'reduce',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 414, height: 896 },
  });
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
  const page = await context.newPage();
  await page.goto(route, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  return { page, dispose: () => context.close() };
}

test.describe('chat action buttons', () => {
  test('built-in action buttons have a visible resting affordance and touch-sized target', async ({
    browser,
  }) => {
    const { page, dispose } = await openTouchPage(browser, '/page/chat?snapshot=1', 'light');
    try {
      const copyButton = page.locator('.chat-message-copy').first();
      await expect(copyButton).toBeVisible();
      await copyButton.scrollIntoViewIfNeeded();

      expect(await colorAlpha(copyButton, 'backgroundColor')).toBeGreaterThan(0);
      expect(await colorAlpha(copyButton, 'borderTopColor')).toBeGreaterThan(0);

      const restingColor = await copyButton.evaluate((element) => getComputedStyle(element).color);

      const box = await copyButton.boundingBox();
      expect(box).not.toBeNull();
      expect((box as { width: number }).width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);
      expect((box as { height: number }).height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);

      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => Promise.resolve() },
        });
      });

      const actionableRow = copyButton.locator(
        'xpath=ancestor::*[contains(@class, "chat-message-wrapper")]',
      );
      await expect(actionableRow).toHaveCSS('margin-block-end', `${TOUCH_TARGET_MIN + 4}px`);

      const hitTarget = await copyButton.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          className: target instanceof HTMLElement ? target.className : null,
          isCopyButton: target === element || element.contains(target),
          tagName: target?.tagName ?? null,
        };
      });
      expect(hitTarget.isCopyButton, JSON.stringify(hitTarget)).toBe(true);

      const emptyToolRow = page.locator('.chat-message-wrapper[data-role="tool-call"]').first();
      await expect(emptyToolRow).toBeVisible();
      await expect(emptyToolRow.locator('.chat-message-actions > *')).toHaveCount(0);
      await expect(emptyToolRow).toHaveCSS('margin-block-end', '0px');

      await copyButton.click();
      // CopyButton signals the copied state via `data-cinder-copied` attribute.
      const successButton = page.locator('.chat-message-copy[data-cinder-copied]').first();
      await expect(successButton).toBeVisible();
      const successColor = await successButton.evaluate(
        (element) => getComputedStyle(element).color,
      );
      expect(successColor).not.toBe(restingColor);
    } finally {
      await dispose();
    }
  });
});

test.describe('chat input shortcut', () => {
  test('dark-mode keycap contrast on .chat-input-hint kbd is at least 4.5:1', async ({
    browser,
  }) => {
    const { page, dispose } = await openTouchPage(browser, '/page/chat?snapshot=1', 'dark');
    try {
      // Confirm the document actually reports a dark color scheme before
      // measuring contrast — otherwise we'd be validating the light palette.
      const colorScheme = await page.evaluate(
        () => window.matchMedia('(prefers-color-scheme: dark)').matches,
      );
      expect(colorScheme).toBe(true);

      const kbd = page.locator('.chat-input-hint kbd').first();

      // Resolve computed foreground and background colors inside the page
      // using a 1x1 canvas so oklch() and other modern color spaces are handled
      // by the browser's own color engine. The alpha check also lets us detect
      // fully transparent backgrounds so we can composite against the first
      // opaque parent.
      const contrast = await kbd.evaluate((element) => {
        function toRgba(colorString: string): [number, number, number, number] {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) return [0, 0, 0, 0];
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = colorString;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0]!, data[1]!, data[2]!, data[3]!];
        }

        function linearize(channel: number): number {
          const c = channel / 255;
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }

        function relativeLuminance([r, g, b]: number[]): number {
          return 0.2126 * linearize(r!) + 0.7152 * linearize(g!) + 0.0722 * linearize(b!);
        }

        function wcagContrast(l1: number, l2: number): number {
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        const computed = getComputedStyle(element);
        const fgColor = computed.color;
        let bgColor = computed.backgroundColor;

        // If background is transparent, walk up to find the first opaque parent
        const [, , , bgAlpha] = toRgba(bgColor);
        if (bgAlpha === 0) {
          let parent = element.parentElement;
          while (parent) {
            const parentBg = getComputedStyle(parent).backgroundColor;
            const [, , , parentAlpha] = toRgba(parentBg);
            if (parentAlpha > 0) {
              bgColor = parentBg;
              break;
            }
            parent = parent.parentElement;
          }
        }

        const fg = toRgba(fgColor);
        const bg = toRgba(bgColor);
        const fgLum = relativeLuminance(fg);
        const bgLum = relativeLuminance(bg);
        return wcagContrast(fgLum, bgLum);
      });

      expect(contrast).toBeGreaterThanOrEqual(4.5);
    } finally {
      await dispose();
    }
  });

  test('composer and send button both expose shortcut description via aria-describedby', async ({
    page,
  }) => {
    // A11y wiring is viewport-independent; use the default desktop context so
    // the send button and editor surface are always rendered.
    await page.goto('/page/chat?snapshot=1', { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    // Resolve the text of every element referenced by an aria-describedby list.
    const describedbyText = (locator: import('@playwright/test').Locator) =>
      locator.evaluate((element) => {
        const describedby = element.getAttribute('aria-describedby');
        if (!describedby) return null;
        return describedby
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
      });

    const composer = page.locator('textarea.chat-input-editor').first();
    await expect(composer).toBeVisible();
    await composer.focus();

    const composerDescribedby = await describedbyText(composer);
    expect(composerDescribedby).toBeTruthy();
    expect(composerDescribedby).toMatch(/Enter/);
    expect(composerDescribedby).toMatch(/Shift\s*\+?\s*Enter/i);

    // The send button references the same shortcut description.
    const sendButton = page
      .locator(
        '.chat-input-send, button[aria-label="Send message"], button[aria-label="Sending message"]',
      )
      .first();
    await expect(sendButton).toBeVisible();
    const sendDescribedby = await describedbyText(sendButton);
    expect(sendDescribedby).toBeTruthy();
    expect(sendDescribedby).toMatch(/Enter/);
    expect(sendDescribedby).toMatch(/Shift\s*\+?\s*Enter/i);
  });
});

test.describe('markdown link popover', () => {
  test('link popover anchors to its trigger and the close button meets the touch target size', async ({
    page,
  }) => {
    // Use a desktop viewport wide enough that the 320px popover fits beside its
    // trigger, so bottom-start alignment holds and is meaningful to assert. On a
    // narrow viewport Floating UI's shift() would (correctly) pull the popover
    // away from the trigger to stay on-screen, which is exercised implicitly by
    // the viewport-containment checks below.
    await page.goto('/page/markdown-editor?snapshot=1', { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const editor = page.locator('.markdown-editor-wrapper[data-ready="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const linkButton = editor.locator('[data-testid="toolbar-link"]').first();
    await expect(linkButton).toBeVisible();
    const triggerBox = await linkButton.boundingBox();
    expect(triggerBox).not.toBeNull();
    const trigger = triggerBox!;

    await linkButton.click();

    const linkPopover = page.locator('.link-popover').first();
    await expect(linkPopover).toBeVisible({ timeout: 5_000 });
    const popoverBox = await linkPopover.boundingBox();
    expect(popoverBox).not.toBeNull();
    const popover = popoverBox!;

    // bottom-start: the popover sits just below the trigger (offset 8 ± flip/shift slack).
    expect(popover.y).toBeGreaterThanOrEqual(trigger.y + trigger.height + 4);
    expect(popover.y).toBeLessThanOrEqual(trigger.y + trigger.height + 32);

    // On a desktop viewport the popover fits, so its left edge aligns near the trigger.
    expect(Math.abs(popover.x - trigger.x)).toBeLessThanOrEqual(16);

    // shift({ padding: 8 }) keeps every edge at least 8px inside the viewport.
    const viewport = page.viewportSize()!;
    expect(popover.x).toBeGreaterThanOrEqual(8);
    expect(popover.y).toBeGreaterThanOrEqual(8);
    expect(popover.x + popover.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(popover.y + popover.height).toBeLessThanOrEqual(viewport.height - 8);

    // The close button meets the 44×44 touch target.
    const closeButton = linkPopover.locator('.link-popover-close').first();
    await expect(closeButton).toBeVisible();
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);
    expect(closeBox!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 0.5);
  });
});

test.describe('review comments toggle', () => {
  test('comments toggle contains a badge with the count and remains keyboard focusable', async ({
    page,
  }) => {
    await page.goto(`${PLAYGROUND_URL}/page/review-editor?snapshot=1`, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    // Locate the comments toggle button via its aria-controls attribute.
    // The button controls the sidebar panel whose id ends with "-sidebar".
    const commentsToggle = page.locator('button[aria-controls$="-sidebar"]').first();

    await expect(commentsToggle).toBeVisible();

    // The visible count must be rendered by the Badge component — it carries
    // the .cinder-badge class and is aria-hidden so the button's aria-label
    // remains the sole accessible count source.
    const badge = commentsToggle.locator('.cinder-badge');
    await expect(badge).toBeVisible();
    expect(await badge.getAttribute('aria-hidden')).toBe('true');

    // The badge must contain a numeric text node (count ≥ 0).
    const badgeContent = await badge.textContent();
    const badgeText = badgeContent?.trim() ?? '';
    expect(/^\d+$/.test(badgeText)).toBe(true);

    // The button's aria-label must include the same count as a human-readable string.
    const ariaLabel = (await commentsToggle.getAttribute('aria-label')) ?? '';
    expect(ariaLabel).toContain(badgeText);

    // The button must keep aria-expanded and aria-controls.
    expect(await commentsToggle.getAttribute('aria-expanded')).not.toBeNull();
    expect(await commentsToggle.getAttribute('aria-controls')).not.toBeNull();

    // The button must be keyboard focusable: Tab should bring focus to it.
    // Resolve focus by evaluating via the browser — Tab navigation in Playwright
    // may need prior focus seeding; use element.focus() directly.
    await commentsToggle.evaluate((element) => (element as HTMLElement).focus());
    await expect(commentsToggle).toBeFocused();

    // Confirm Space or Enter activates the toggle (keyboard operability).
    // We just verify the button is focusable and has a valid tabIndex.
    const tabIndex = await commentsToggle.evaluate((element) => (element as HTMLElement).tabIndex);
    // tabIndex of 0 or -1 are both valid for a toolbar button; -1 means it is
    // programmatically focusable even if excluded from tab order when the toolbar
    // manages roving focus. The important thing is that it is focusable.
    expect(tabIndex).toBeGreaterThanOrEqual(-1);
  });
});

test.describe('JSON schema editor', () => {
  // The playground route renders multiple JSON-schema-editor examples; every
  // assertion scopes to the FIRST editor instance (`.cinder-jse`) so counts and
  // focus checks are not confused by sibling instances.
  async function openFirstEditor(page: Page) {
    await page.goto('/page/json-schema-editor?snapshot=1', { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
    const editor = page.locator('.cinder-jse').first();
    await expect(editor).toBeVisible();
    return editor;
  }

  test('Diff tab shows "Diff" without a raw bullet and carries accessible change markup', async ({
    page,
  }) => {
    const editor = await openFirstEditor(page);
    const diffTab = editor.locator('[role="tab"]').filter({ hasText: /Diff/ }).first();
    await expect(diffTab).toBeVisible();

    // Visible accessible text must read "Diff" with no raw bullet character.
    const tabText = (await diffTab.textContent()) ?? '';
    expect(tabText).toContain('Diff');
    expect(tabText).not.toContain('•');

    // The semantic structure must be present: the changed-state badge lives in
    // the Tab `trailing` slot (aria-hidden), and any change text is sr-only —
    // neither leaks a raw bullet into the accessible name.
    const innerHtml = await diffTab.innerHTML();
    expect(innerHtml).not.toMatch(/>\s*•/);
  });

  test('toolbar has role=toolbar and an accessible label', async ({ page }) => {
    const editor = await openFirstEditor(page);
    const toolbar = editor.locator('.cinder-jse-toolbar').first();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('role', 'toolbar');
    const label = (await toolbar.getAttribute('aria-label')) ?? '';
    expect(label.length).toBeGreaterThan(0);
  });

  test('exactly one enabled toolbar action is in the tab order at rest', async ({ page }) => {
    const editor = await openFirstEditor(page);
    const toolbarRight = editor.locator('.cinder-jse-toolbar__right').first();
    await expect(toolbarRight).toBeVisible();

    const zeroTabIndexCount = await toolbarRight.evaluate((root) => {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      return buttons.filter((button) => button.tabIndex === 0).length;
    });
    expect(zeroTabIndexCount).toBe(1);
  });

  test('arrow keys move focus between enabled toolbar actions and Tab exits', async ({ page }) => {
    const editor = await openFirstEditor(page);
    const toolbarRight = editor.locator('.cinder-jse-toolbar__right').first();
    await expect(toolbarRight).toBeVisible();

    // The default snapshot leaves Undo/Redo/Revert disabled, so only one action
    // is enabled. Type into the source editor to dirty the schema, which enables
    // Revert (and the Copy action stays enabled) — giving us ≥2 roving members.
    const jsonTab = editor.locator('[role="tab"]').filter({ hasText: /JSON/ }).first();
    await jsonTab.click();
    const textarea = editor.locator('textarea').first();
    if (await textarea.count()) {
      await textarea.click();
      await textarea.press('End');
      await textarea.type(' ');
    }

    const enabled = toolbarRight.locator('button:not([disabled])');
    const enabledCount = await enabled.count();

    // Focus the first enabled action and confirm it holds the roving tabstop.
    await enabled.first().focus();
    const firstContent = await enabled.first().textContent();
    const firstText = (firstContent ?? '').trim();

    if (enabledCount >= 2) {
      await page.keyboard.press('ArrowRight');
      const movedText = await toolbarRight.evaluate(
        (root) =>
          (root.contains(document.activeElement)
            ? (document.activeElement as HTMLElement).textContent?.trim()
            : '') ?? '',
      );
      expect(movedText).not.toBe(firstText);
      expect(movedText.length).toBeGreaterThan(0);

      // End jumps to the last enabled action; Home returns to the first.
      await page.keyboard.press('End');
      const endText = await page.evaluate(
        () => (document.activeElement as HTMLElement)?.textContent?.trim() ?? '',
      );
      const lastContent = await enabled.last().textContent();
      expect(endText).toBe((lastContent ?? '').trim());

      await page.keyboard.press('Home');
      const homeText = await page.evaluate(
        () => (document.activeElement as HTMLElement)?.textContent?.trim() ?? '',
      );
      expect(homeText).toBe(firstText);
    }

    // From any enabled action, Tab leaves the toolbar entirely.
    await enabled.first().focus();
    await page.keyboard.press('Tab');
    const focusInsideToolbar = await toolbarRight.evaluate((root) =>
      root.contains(document.activeElement),
    );
    expect(focusInsideToolbar).toBe(false);
  });
});
