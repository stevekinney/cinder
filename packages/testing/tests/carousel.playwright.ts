import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const carousel = loadManifest().find((entry) => entry.slug === 'carousel');
if (!carousel) throw new Error('Carousel manifest entry is missing.');
const desktopViewport = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
if (!desktopViewport) throw new Error('Desktop viewport fixture is missing.');
// Chromium serializes the equivalent `pan-x pan-y pinch-zoom` declaration as
// its `manipulation` alias in computed styles.
const nativePanTouchAction = /^(?:manipulation|pan-x pan-y pinch-zoom)$/;

test('carousel uses a native snapping track and keeps pagination in sync', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: carousel,
    theme: 'light',
    viewport: desktopViewport,
  });

  const viewport = page.locator('.cinder-carousel__viewport');
  await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);
  await expect(viewport).toHaveCSS('touch-action', nativePanTouchAction);
  await expect(viewport.locator('.cinder-carousel__slide')).toHaveCount(3);

  await viewport.evaluate((element) => {
    const viewportElement = element as HTMLElement;
    viewportElement.scrollLeft = viewportElement.clientWidth;
    viewportElement.dispatchEvent(new Event('scroll'));
  });

  await expect(page.locator('.cinder-carousel__dot[aria-current="true"]')).toHaveAttribute(
    'aria-label',
    'Go to Patterns',
  );
  await expect(viewport.locator('.cinder-carousel__slide[aria-hidden="true"]')).toHaveCount(2);
});

test('carousel track remains scrollable in a touch-capable context', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: PLAYGROUND_URL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/page/carousel?snapshot=1', { waitUntil: 'load' });
    const viewport = page.locator('.cinder-carousel__viewport');
    await expect(viewport).toBeVisible();
    await expect(viewport).toHaveCSS('touch-action', nativePanTouchAction);
    await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);
  } finally {
    await context.close();
  }
});
