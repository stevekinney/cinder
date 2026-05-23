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
  return scrollFixtureTo(page, { top: 120, left: 140 });
}

async function scrollFixtureTo(
  page: import('@playwright/test').Page,
  coordinates: { top: number; left: number },
) {
  const scrollContainer = page.getByTestId('transformed-scroll-container');
  await scrollContainer.evaluate((element, nextCoordinates) => {
    element.scrollTo(nextCoordinates);
  }, coordinates);
  await expect
    .poll(async () =>
      scrollContainer.evaluate((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
      })),
    )
    .toEqual(coordinates);
}

function expectOverlayToTrackTriggerVertically(
  initialTriggerBox: { y: number; height: number },
  nextTriggerBox: { y: number; height: number },
  initialOverlayBox: { y: number; height: number },
  nextOverlayBox: { y: number; height: number },
) {
  const triggerDeltaY = nextTriggerBox.y - initialTriggerBox.y;
  const overlayDeltaY = nextOverlayBox.y - initialOverlayBox.y;

  expect(Math.abs(overlayDeltaY - triggerDeltaY)).toBeLessThanOrEqual(2);
}

function expectOverlayToTrackTriggerHorizontally(
  initialTriggerBox: { x: number; width: number },
  nextTriggerBox: { x: number; width: number },
  initialOverlayBox: { x: number; width: number },
  nextOverlayBox: { x: number; width: number },
) {
  const triggerDeltaX = nextTriggerBox.x - initialTriggerBox.x;
  const overlayDeltaX = nextOverlayBox.x - initialOverlayBox.x;

  expect(Math.abs(overlayDeltaX - triggerDeltaX)).toBeLessThanOrEqual(2);
}

async function moveTransformedShell(page: import('@playwright/test').Page, translateX: number) {
  const shell = page.getByTestId('transformed-shell');
  await shell.evaluate((element, nextTranslateX) => {
    element.setAttribute(
      'style',
      `transform: translate3d(${nextTranslateX}px, 0, 0) scale(0.98); transform-origin: top left; padding: 1rem; border-radius: 1rem; background: var(--cinder-surface-raised); border: 1px solid var(--cinder-border);`,
    );
  }, translateX);
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
  expect(triggerCenter).toBeGreaterThanOrEqual(overlayBox.x - 16);
  expect(triggerCenter).toBeLessThanOrEqual(overlayBox.x + overlayBox.width + 16);
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

  const initialTriggerBox = triggerBox as { x: number; y: number; width: number; height: number };
  const initialOverlayBox = overlayBox as { x: number; y: number; width: number; height: number };

  await moveTransformedShell(page, 72);
  await expect.poll(async () => panel.getAttribute('data-cinder-position-ready')).toBe('true');

  const nextTriggerBox = await trigger.boundingBox();
  const nextOverlayBox = await panel.boundingBox();
  expect(nextTriggerBox).not.toBeNull();
  expect(nextOverlayBox).not.toBeNull();

  expectBottomPlacementGeometry(
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    nextOverlayBox as { x: number; y: number; width: number; height: number },
    await panel.getAttribute('data-cinder-placement'),
  );
  expectOverlayToTrackTriggerVertically(
    initialTriggerBox,
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    initialOverlayBox,
    nextOverlayBox as { x: number; y: number; width: number; height: number },
  );
  expectOverlayToTrackTriggerHorizontally(
    initialTriggerBox,
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    initialOverlayBox,
    nextOverlayBox as { x: number; y: number; width: number; height: number },
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

  const initialTriggerBox = triggerBox as { x: number; y: number; width: number; height: number };
  const initialOverlayBox = overlayBox as { x: number; y: number; width: number; height: number };

  await moveTransformedShell(page, 72);
  await trigger.hover();
  await expect.poll(async () => tooltip.getAttribute('data-cinder-position-ready')).toBe('true');

  const nextTriggerBox = await trigger.boundingBox();
  const nextOverlayBox = await tooltip.boundingBox();
  expect(nextTriggerBox).not.toBeNull();
  expect(nextOverlayBox).not.toBeNull();

  expectBottomPlacementGeometry(
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    nextOverlayBox as { x: number; y: number; width: number; height: number },
    await tooltip.getAttribute('data-cinder-placement'),
  );
  expectOverlayToTrackTriggerVertically(
    initialTriggerBox,
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    initialOverlayBox,
    nextOverlayBox as { x: number; y: number; width: number; height: number },
  );
  expectOverlayToTrackTriggerHorizontally(
    initialTriggerBox,
    nextTriggerBox as { x: number; y: number; width: number; height: number },
    initialOverlayBox,
    nextOverlayBox as { x: number; y: number; width: number; height: number },
  );

  await captureScreenshot(page, {
    slug: 'tooltip',
    theme: 'light',
    viewport: 'desktop',
    fixture: 'transformed-ancestor-shell',
  });
});
