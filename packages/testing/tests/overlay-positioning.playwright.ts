import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';
import { captureScreenshot } from '../src/helpers/screenshot.ts';

const manifest = loadManifest();
const desktopViewport = VIEWPORTS.find((viewport) => viewport.name === 'desktop');

if (!desktopViewport) {
  throw new Error('Desktop viewport is required for overlay positioning tests.');
}

function manifestEntry(slug: 'popover' | 'tooltip') {
  const entry = manifest.find((candidate) => candidate.slug === slug);
  if (!entry) {
    throw new Error(`Missing manifest entry for ${slug}.`);
  }
  return entry;
}

async function scrollFixture(page: import('@playwright/test').Page) {
  const scrollContainer = page.getByTestId('transformed-scroll-container');
  await scrollContainer.evaluate((element) => {
    element.scrollTo({ top: 120, left: 140 });
  });
  await expect
    .poll(async () =>
      scrollContainer.evaluate((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
      })),
    )
    .toEqual({ top: 120, left: 140 });
}

function expectBottomPlacementGeometry(
  triggerBox: { x: number; y: number; width: number; height: number },
  overlayBox: { x: number; y: number; width: number; height: number },
  placement: string | null,
) {
  expect(overlayBox.width).toBeGreaterThan(0);
  expect(overlayBox.height).toBeGreaterThan(0);
  expect(placement?.startsWith('bottom')).toBeTruthy();

  const verticalGap = overlayBox.y - (triggerBox.y + triggerBox.height);
  expect(verticalGap).toBeGreaterThanOrEqual(4);
  expect(verticalGap).toBeLessThanOrEqual(24);

  const triggerCenter = triggerBox.x + triggerBox.width / 2;
  const overlayCenter = overlayBox.x + overlayBox.width / 2;
  expect(Math.abs(overlayCenter - triggerCenter)).toBeLessThanOrEqual(16);
}

test('popover anchors inside transformed and scrolled preview shells', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: manifestEntry('popover'),
    theme: 'light',
    viewport: desktopViewport,
    fixtureName: 'transformed-ancestor',
  });

  await scrollFixture(page);

  const trigger = page.getByTestId('transformed-popover-trigger');
  await trigger.click();
  const panel = page.locator('.transformed-ancestor-popover-panel');
  await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');

  const triggerBox = await trigger.boundingBox();
  const overlayBox = await panel.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();

  expectBottomPlacementGeometry(
    triggerBox as { x: number; y: number; width: number; height: number },
    overlayBox as { x: number; y: number; width: number; height: number },
    await panel.getAttribute('data-cinder-placement'),
  );

  await captureScreenshot(page, {
    slug: 'popover',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'transformed-ancestor-shell',
  });
});

test('tooltip anchors inside transformed and scrolled preview shells', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: manifestEntry('tooltip'),
    theme: 'light',
    viewport: desktopViewport,
    fixtureName: 'transformed-ancestor',
  });

  await scrollFixture(page);

  const trigger = page.getByTestId('transformed-tooltip-trigger');
  await trigger.hover();
  const tooltip = page.getByRole('tooltip', { name: 'Transformed ancestor tooltip anchor' });
  await expect(tooltip).toHaveAttribute('data-cinder-position-ready', 'true');

  const triggerBox = await trigger.boundingBox();
  const overlayBox = await tooltip.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();

  expectBottomPlacementGeometry(
    triggerBox as { x: number; y: number; width: number; height: number },
    overlayBox as { x: number; y: number; width: number; height: number },
    await tooltip.getAttribute('data-cinder-placement'),
  );

  await captureScreenshot(page, {
    slug: 'tooltip',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'transformed-ancestor-shell',
  });
});
