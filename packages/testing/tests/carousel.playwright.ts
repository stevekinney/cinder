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

  // The docs page mounts every example for this component on one surface —
  // scope to the "basic" example so a second carousel example elsewhere on
  // the page (e.g. "multi-view") can't turn a locator ambiguous.
  const scope = page.locator('#example-mount-basic');
  const viewport = scope.locator('.cinder-carousel__viewport');
  await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);
  await expect(viewport).toHaveCSS('touch-action', nativePanTouchAction);
  await expect(viewport.locator('.cinder-carousel__slide')).toHaveCount(3);

  await viewport.evaluate((element) => {
    const viewportElement = element as HTMLElement;
    viewportElement.scrollLeft = viewportElement.clientWidth;
    viewportElement.dispatchEvent(new Event('scroll'));
  });

  await expect(scope.locator('.cinder-carousel__dot[aria-current="true"]')).toHaveAttribute(
    'aria-label',
    'Go to Patterns',
  );
  await expect(viewport.locator('.cinder-carousel__slide[aria-hidden="true"]')).toHaveCount(2);
});

test('slidesPerView makes multiple slides simultaneously interactive', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: carousel,
    theme: 'light',
    viewport: desktopViewport,
  });

  const scope = page.locator('#example-mount-multi-view');
  const viewport = scope.locator('.cinder-carousel__viewport');
  await expect(viewport).toBeVisible();

  // slidesPerView={1.2} rounds up to a 2-slide active range: the first two
  // slides are non-inert, the rest are inert.
  const slides = viewport.locator('.cinder-carousel__slide');
  await expect(slides.nth(0)).not.toHaveAttribute('aria-hidden', 'true');
  await expect(slides.nth(1)).not.toHaveAttribute('aria-hidden', 'true');
  await expect(slides.nth(2)).toHaveAttribute('aria-hidden', 'true');

  const liveRegion = scope.locator('[aria-live]');
  await expect(liveRegion).toHaveText(/^Slides 1–2 of 6$/);
});

test('mouse drag disables native snapping only while dragging, then restores it', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: carousel,
    theme: 'light',
    viewport: desktopViewport,
  });

  const viewport = page.locator('#example-mount-basic .cinder-carousel__viewport');
  // Baseline: this must stay true for keyboard/wheel/touch users, who are
  // never in a mouse drag — the engine only overrides it transiently.
  await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);

  const box = await viewport.boundingBox();
  if (!box) throw new Error('Carousel viewport has no layout box.');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height / 2;

  // Diagnostic: this Playwright environment's actual matchMedia answers for
  // the two inputs `enabled()` gates on, surfaced as a hard assertion so a
  // CI failure names the exact gate rather than requiring another
  // round-trip. Desktop Chrome (devices['Desktop Chrome']) has no touch/
  // mobile emulation, so both are expected true here.
  const mediaState = await page.evaluate(() => ({
    finePointer: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  expect(mediaState).toEqual({ finePointer: true, reducedMotion: false });

  await page.mouse.move(startX, y);
  await page.mouse.down();

  // Diagnostic checkpoint: `suppressSnapType()` runs unconditionally inside
  // `onPointerDown` (gated only on `enabled()`), before any drag-threshold
  // logic. If this fails, the engine never attached at all — check
  // `enabled()`'s inputs (fine-pointer/reduced-motion) — as opposed to the
  // drag-threshold detection in `onPointerMove` specifically.
  await expect(viewport).toHaveCSS('scroll-snap-type', 'none');

  await page.mouse.move(startX - 80, y, { steps: 5 });

  await expect(viewport).toHaveAttribute('data-cinder-dragging', '');

  await page.mouse.up();

  await expect(viewport).not.toHaveAttribute('data-cinder-dragging', '');
  await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);
});

test('the carousel remains normally interactive after a mouse drag releases', async ({
  componentPage,
}) => {
  const page = await componentPage.open({
    entry: carousel,
    theme: 'light',
    viewport: desktopViewport,
  });

  const scope = page.locator('#example-mount-basic');
  const viewport = scope.locator('.cinder-carousel__viewport');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('Carousel viewport has no layout box.');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 80, y, { steps: 5 });
  await page.mouse.up();

  // The click-suppression window is a single macrotask
  // (`use-drag-scroll.svelte.test.ts` verifies the mechanism deterministically);
  // what a real browser adds is confirming pointer capture and event ordering
  // don't leave the carousel stuck — an ordinary click still works right after.
  const dots = scope.locator('.cinder-carousel__dot');
  await dots.nth(2).click();
  await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
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
    const viewport = page.locator('#example-mount-basic .cinder-carousel__viewport');
    await expect(viewport).toBeVisible();
    await expect(viewport).toHaveCSS('touch-action', nativePanTouchAction);
    await expect(viewport).toHaveCSS('scroll-snap-type', /x mandatory/);
  } finally {
    await context.close();
  }
});
