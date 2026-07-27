import { expect, test, type Locator, type Page } from '@playwright/test';

const EVENT_TIMELINE_ROUTE = '/page/event-timeline?snapshot=1';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function boxesOverlap(first: Box, second: Box): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function openOverlapTimeline(page: Page): Promise<Locator> {
  await page.goto(EVENT_TIMELINE_ROUTE, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  return page.getByRole('list', { name: 'Clustered deployment timeline' });
}

test('overlapping event labels occupy non-intersecting layout boxes', async ({ page }) => {
  const timeline = await openOverlapTimeline(page);
  const root = timeline.locator('..');
  await root.evaluate((element) => {
    (element as HTMLElement).style.width = '32rem';
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

  const labels = timeline.locator('.cinder-event-timeline__content');
  await expect(labels).toHaveCount(4);
  const boxes = (await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  )) as Box[];

  for (let index = 0; index < boxes.length; index += 1) {
    for (let comparisonIndex = index + 1; comparisonIndex < boxes.length; comparisonIndex += 1) {
      expect(boxesOverlap(boxes[index]!, boxes[comparisonIndex]!)).toBe(false);
    }
  }
});

test('cluster trigger supports tab entry, Escape dismissal, and focus return', async ({ page }) => {
  await page.goto(EVENT_TIMELINE_ROUTE, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  const timeline = page.getByRole('list', { name: 'Dense incident timeline' });

  const trigger = timeline.locator('.cinder-event-timeline__cluster-trigger').first();
  await expect(trigger).toBeVisible();

  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let tabIndex = 0; tabIndex < 50; tabIndex += 1) {
    await page.keyboard.press('Tab');
    if (await trigger.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(trigger).toBeFocused();

  const clusterName = await trigger.getAttribute('aria-label');
  if (!clusterName) {
    throw new Error('Event timeline cluster trigger must have an accessible name.');
  }
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: clusterName });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
