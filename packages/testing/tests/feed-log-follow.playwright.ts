import { expect, test } from '@playwright/test';

/**
 * Follow-latest scrolling for Feed's log arm (`kind="log"`).
 *
 * The auto-scroll-on-growth path is driven by a real ResizeObserver on the
 * entry list, which happy-dom cannot provide — the unit suite covers the
 * scroll-pause handler, this suite covers the observer wiring:
 *
 *   1. an overflowing log opens scrolled to the latest entry (the observer's
 *      initial fire),
 *   2. appended content re-scrolls the viewport while following,
 *   3. scrolling away pauses following (data-cinder-paused + resume control)
 *      and appended content then does NOT move the reading position.
 */

const VIEWPORT = '.cinder-feed-log__viewport';

async function overflowLog(page: import('@playwright/test').Page) {
  // Cap the first log's viewport so the example content overflows it.
  await page
    .locator(VIEWPORT)
    .first()
    .evaluate((el) => {
      (el as HTMLElement).style.maxBlockSize = '8rem';
    });
}

test.describe('Feed log arm follow-latest', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/page/feed?snapshot=1', { waitUntil: 'load' });
    await overflowLog(page);
  });

  test('appended content auto-scrolls the viewport while following', async ({ page }) => {
    const viewport = page.locator(VIEWPORT).first();
    // Grow the list — the ResizeObserver must scroll the viewport to the
    // new bottom (this also proves the initial-fire scroll, since the
    // assertion is on the post-append geometry).
    await viewport.evaluate((el) => {
      const list = el.querySelector('ol.cinder-feed');
      if (!list) throw new Error('log list missing');
      for (let index = 0; index < 5; index += 1) {
        const item = document.createElement('li');
        item.className = 'cinder-feed-event';
        item.textContent = `appended entry ${index}`;
        item.style.blockSize = '3rem';
        list.appendChild(item);
      }
    });
    await expect
      .poll(async () => viewport.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(2);
  });

  test('scrolling away pauses following and appended content stays put', async ({ page }) => {
    const viewport = page.locator(VIEWPORT).first();
    const root = page.locator('.cinder-feed-log').first();

    // Capping the viewport does not resize the LIST, so nothing has scrolled
    // yet — grow the list once so follow-latest brings us to the bottom.
    await viewport.evaluate((el) => {
      const list = el.querySelector('ol.cinder-feed');
      if (!list) throw new Error('log list missing');
      const item = document.createElement('li');
      item.className = 'cinder-feed-event';
      item.textContent = 'growth trigger';
      item.style.blockSize = '3rem';
      list.appendChild(item);
    });
    await expect
      .poll(async () => viewport.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(2);
    await viewport.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });

    await expect(root).toHaveAttribute('data-cinder-paused', '');
    await expect(page.locator('.cinder-feed-log__resume-button').first()).toBeVisible();

    // Append while paused — the reading position must not move.
    await viewport.evaluate((el) => {
      const list = el.querySelector('ol.cinder-feed');
      if (!list) throw new Error('log list missing');
      const item = document.createElement('li');
      item.className = 'cinder-feed-event';
      item.textContent = 'appended while paused';
      item.style.blockSize = '3rem';
      list.appendChild(item);
    });
    // Give a would-be auto-scroll a moment to (incorrectly) fire.
    await page.waitForTimeout(250);
    expect(await viewport.evaluate((el) => el.scrollTop)).toBeLessThan(4);

    // The resume control returns to the latest entry and moves focus to the
    // viewport (the button unmounts itself).
    await page.locator('.cinder-feed-log__resume-button').first().click();
    await expect
      .poll(async () => viewport.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(2);
    await expect(root).not.toHaveAttribute('data-cinder-paused', '');
    const focusedIsViewport = await viewport.evaluate((el) => document.activeElement === el);
    expect(focusedIsViewport).toBe(true);
  });
});
