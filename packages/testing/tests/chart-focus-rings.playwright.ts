import { expect, test, type Locator, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

type ChartDefinition = {
  slug: 'area-chart' | 'line-chart' | 'bar-chart';
  rootClass: string;
  targetClass: string;
  hitSurfaceClass: string;
  targetId: string;
  seriesId: string;
  accessibleName: string;
  tooltipText: string;
};

type ElementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScreenshotClip = ElementBox;

type TabbableSummary = {
  tagName: string;
  role: string | null;
  ariaLabel: string | null;
  text: string;
  targetId: string | null;
  seriesId: string | null;
};

const charts: ChartDefinition[] = [
  {
    slug: 'area-chart',
    rootClass: 'cinder-area-chart',
    targetClass: 'cinder-area-chart__focus-target',
    hitSurfaceClass: 'cinder-area-chart__hit-surface',
    targetId: 'usage-string:Jan',
    seriesId: 'usage',
    accessibleName: 'Usage, Jan, 44',
    tooltipText: 'Jan: 44',
  },
  {
    slug: 'line-chart',
    rootClass: 'cinder-line-chart',
    targetClass: 'cinder-line-chart__focus-target',
    hitSurfaceClass: 'cinder-line-chart__hit-surface',
    targetId: 'revenue-string:Jan',
    seriesId: 'revenue',
    accessibleName: 'Revenue, Jan, 120',
    tooltipText: 'Jan: 120',
  },
  {
    slug: 'bar-chart',
    rootClass: 'cinder-bar-chart',
    targetClass: 'cinder-bar-chart__focus-target',
    hitSurfaceClass: 'cinder-bar-chart__hit-surface',
    targetId: 'active-string:Starter',
    seriesId: 'active',
    accessibleName: 'Active users, Starter, 120',
    tooltipText: 'Starter: 120',
  },
];

function routeFor(chart: ChartDefinition): string {
  return `/page/${chart.slug}?snapshot=1`;
}

function targetSelector(chart: ChartDefinition): string {
  return `.${chart.targetClass}[data-cinder-target-id="${chart.targetId}"][data-cinder-series-id="${chart.seriesId}"]`;
}

function primaryRingSelector(chart: ChartDefinition): string {
  return `.${chart.rootClass}__focus-ring:not(.${chart.rootClass}__focus-ring-connector):not(.${chart.rootClass}__focus-ring-dot)`;
}

async function chartRoot(page: Page, chart: ChartDefinition): Promise<Locator> {
  const target = page.locator(targetSelector(chart)).first();
  await expect(target).toHaveAttribute('aria-label', chart.accessibleName);
  const root = page.locator(`.${chart.rootClass}`).filter({ has: target }).first();
  await expect(root).toBeVisible();
  return root;
}

async function focusTargetDirectly(page: Page, chart: ChartDefinition): Promise<Locator> {
  const target = page.locator(targetSelector(chart)).first();
  await target.focus();
  await expect(target).toBeFocused();
  return target;
}

async function activeElementSummary(page: Page): Promise<TabbableSummary> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof Element)) {
      return {
        tagName: '(none)',
        role: null,
        ariaLabel: null,
        text: '',
        targetId: null,
        seriesId: null,
      };
    }
    return {
      tagName: active.tagName.toLowerCase(),
      role: active.getAttribute('role'),
      ariaLabel: active.getAttribute('aria-label'),
      text: active.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
      targetId: active.getAttribute('data-cinder-target-id'),
      seriesId: active.getAttribute('data-cinder-series-id'),
    };
  });
}

async function tabUntilChartTargetFocused(
  page: Page,
  chart: ChartDefinition,
  maximumAttempts = 100,
): Promise<TabbableSummary[]> {
  const encountered: TabbableSummary[] = [];
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    await page.keyboard.press('Tab');
    const summary = await activeElementSummary(page);
    encountered.push(summary);
    if (summary.targetId === chart.targetId && summary.seriesId === chart.seriesId) {
      return encountered;
    }
  }
  throw new Error(
    `${chart.slug}: Tab did not reach ${chart.targetId}. Encountered: ${JSON.stringify(
      encountered,
      null,
      2,
    )}`,
  );
}

async function resetFocusToBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (
      document.activeElement instanceof HTMLElement ||
      document.activeElement instanceof SVGElement
    ) {
      (document.activeElement as HTMLElement | SVGElement).blur();
    }
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
}

async function insertSentinelBeforeChartViewport(
  root: Locator,
  chart: ChartDefinition,
): Promise<void> {
  const svg = root.locator('svg').first();
  const documentBox = async (): Promise<ElementBox> =>
    svg.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        x: box.x + window.scrollX,
        y: box.y + window.scrollY,
        width: box.width,
        height: box.height,
      };
    });
  const before = await documentBox();

  await root.evaluate((element, rootClass) => {
    const viewport = element.querySelector(`.${rootClass}__viewport`);
    if (!viewport?.parentElement) throw new Error(`Missing .${rootClass}__viewport`);
    const sentinel = document.createElement('button');
    sentinel.type = 'button';
    sentinel.textContent = 'chart focus sentinel';
    sentinel.setAttribute('data-chart-focus-sentinel', '');
    Object.assign(sentinel.style, {
      position: 'fixed',
      inset: '0 auto auto 0',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '0',
      border: '0',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    });
    viewport.parentElement.insertBefore(sentinel, viewport);
  }, chart.rootClass);

  const after = await documentBox();
  expect(Math.abs(after.x - before.x), `${chart.slug}: sentinel changed SVG x`).toBeLessThanOrEqual(
    0.5,
  );
  expect(Math.abs(after.y - before.y), `${chart.slug}: sentinel changed SVG y`).toBeLessThanOrEqual(
    0.5,
  );
  expect(
    Math.abs(after.width - before.width),
    `${chart.slug}: sentinel changed SVG width`,
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(after.height - before.height),
    `${chart.slug}: sentinel changed SVG height`,
  ).toBeLessThanOrEqual(0.5);
}

async function focusFromSentinel(page: Page, chart: ChartDefinition): Promise<TabbableSummary[]> {
  const sentinel = page.locator('[data-chart-focus-sentinel]').first();
  await sentinel.focus();
  await expect(sentinel).toBeFocused();
  const encountered = await tabUntilChartTargetFocused(page, chart);
  await expect(page.locator(targetSelector(chart)).first()).toBeFocused();
  return encountered;
}

async function ringStyleSnapshot(root: Locator, chart: ChartDefinition) {
  const layer = root.locator(`.${chart.rootClass}__focus-ring-layer`);
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  const ring = root.locator(primaryRingSelector(chart)).first();
  const halo = root.locator(`.${chart.rootClass}__focus-ring-halo`).first();
  await expect(ring).toHaveCount(1);
  await expect(halo).toHaveCount(1);
  return ring.evaluate((element, haloClass) => {
    const boxToObject = (box: DOMRect): ElementBox => ({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    const styles = getComputedStyle(element);
    const halo = element.closest('g')?.querySelector(`.${haloClass}`);
    if (!(halo instanceof SVGElement)) throw new Error('Focus ring halo is missing.');
    const haloStyles = getComputedStyle(halo);
    const ringBox = element.getBoundingClientRect();
    const svg = element.closest('svg');
    if (!(svg instanceof SVGElement)) throw new Error('Focus ring is not inside an SVG.');
    const svgBox = svg.getBoundingClientRect();
    const stroke = styles.stroke;
    const strokeWidth = Number.parseFloat(styles.strokeWidth);
    return {
      stroke,
      strokeWidth,
      filter: styles.filter,
      haloDisplay: haloStyles.display,
      pointerEvents: styles.pointerEvents,
      vectorEffect: styles.getPropertyValue('vector-effect'),
      ringBox: boxToObject(ringBox),
      svgBox: boxToObject(svgBox),
    };
  }, `${chart.rootClass}__focus-ring-halo`);
}

function expectNonTransparentStroke(stroke: string): void {
  expect(stroke).toBeTruthy();
  expect(stroke).not.toBe('none');
  expect(stroke).not.toBe('transparent');
  expect(stroke).not.toMatch(/rgba\([^)]*,\s*0(?:\s*\)|\s*%)/i);
  expect(stroke).not.toMatch(/rgb\([^)]*\/\s*0(?:\s*\)|\s*%)/i);
}

function expectBoxInside(inner: ElementBox, outer: ElementBox, label: string): void {
  const tolerance = 1;
  expect(inner.x, `${label}: left edge`).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y, `${label}: top edge`).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width, `${label}: right edge`).toBeLessThanOrEqual(
    outer.x + outer.width + tolerance,
  );
  expect(inner.y + inner.height, `${label}: bottom edge`).toBeLessThanOrEqual(
    outer.y + outer.height + tolerance,
  );
}

async function assertVisibleRing(root: Locator, chart: ChartDefinition, forcedColors = false) {
  const snapshot = await ringStyleSnapshot(root, chart);
  expectNonTransparentStroke(snapshot.stroke);
  expect(snapshot.strokeWidth).toBeGreaterThan(0);
  expect(snapshot.pointerEvents).toBe('none');
  expect(snapshot.vectorEffect).toBe('non-scaling-stroke');
  expect(snapshot.ringBox.width).toBeGreaterThan(0);
  expect(snapshot.ringBox.height).toBeGreaterThan(0);
  expectBoxInside(snapshot.ringBox, snapshot.svgBox, `${chart.slug} focus ring inside SVG`);

  if (forcedColors) {
    expect(snapshot.filter).toBe('none');
    expect(snapshot.haloDisplay).toBe('none');
  }
}

async function ringScreenshotClip(
  page: Page,
  root: Locator,
  chart: ChartDefinition,
): Promise<ScreenshotClip> {
  await root.scrollIntoViewIfNeeded();

  const ring = root.locator(primaryRingSelector(chart)).first();
  const svg = root.locator('svg').first();
  const ringBox = await ring.boundingBox();
  const svgBox = await svg.boundingBox();
  if (!ringBox || !svgBox) throw new Error(`${chart.slug}: missing ring or SVG screenshot clip.`);
  expect(ringBox.width, `${chart.slug}: ring screenshot width`).toBeGreaterThan(0);
  expect(ringBox.height, `${chart.slug}: ring screenshot height`).toBeGreaterThan(0);
  expectBoxInside(ringBox, svgBox, `${chart.slug} screenshot ring inside SVG`);
  const deviceScaleFactor = await page.evaluate(() => window.devicePixelRatio || 1);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error(`${chart.slug}: missing viewport for screenshot clip.`);
  const padding = Math.ceil(deviceScaleFactor * 4);
  const x = Math.max(0, svgBox.x, ringBox.x - padding);
  const y = Math.max(0, svgBox.y, ringBox.y - padding);
  const right = Math.min(
    viewport.width,
    svgBox.x + svgBox.width,
    ringBox.x + ringBox.width + padding,
  );
  const bottom = Math.min(
    viewport.height,
    svgBox.y + svgBox.height,
    ringBox.y + ringBox.height + padding,
  );

  if (right <= x || bottom <= y) {
    throw new Error(
      `${chart.slug}: focus ring screenshot clip is outside the viewport. ${JSON.stringify({
        ringBox,
        svgBox,
        viewport,
      })}`,
    );
  }

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

async function clippedScreenshot(page: Page, clip: ScreenshotClip): Promise<Buffer> {
  return page.screenshot({ clip });
}

function changedPixelCount(beforeBuffer: Buffer, afterBuffer: Buffer): number {
  const before = PNG.sync.read(beforeBuffer);
  const after = PNG.sync.read(afterBuffer);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  return pixelmatch(before.data, after.data, undefined, before.width, before.height, {
    threshold: 0.1,
  });
}

test.describe('chart SVG focus rings', () => {
  for (const chart of charts) {
    test(`${chart.slug}: real Tab focus creates one visible SVG ring and a pixel delta`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(routeFor(chart), { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');

      const root = await chartRoot(page, chart);
      await resetFocusToBody(page);
      const encountered = await tabUntilChartTargetFocused(page, chart);
      expect(encountered.at(-1)?.ariaLabel).toBe(chart.accessibleName);
      const target = page.locator(targetSelector(chart)).first();
      await expect(target).toBeFocused();
      const diagnostic = await target.evaluate((element) => ({
        ariaLabel: element.getAttribute('aria-label'),
        matchesFocusVisible: element.matches(':focus-visible'),
      }));
      expect(diagnostic.ariaLabel).toBe(chart.accessibleName);

      await assertVisibleRing(root, chart);

      await page.addStyleTag({
        content: '[role="tooltip"] { visibility: hidden !important; }',
      });
      await insertSentinelBeforeChartViewport(root, chart);
      const clip = await ringScreenshotClip(page, root, chart);
      const afterFocus = await clippedScreenshot(page, clip);
      await page.locator('[data-chart-focus-sentinel]').first().focus();
      const beforeFocus = await clippedScreenshot(page, clip);
      await focusFromSentinel(page, chart);
      await expect(target).toHaveAttribute('data-cinder-target-id', chart.targetId);
      const afterRefocus = await clippedScreenshot(page, clip);

      expect(
        changedPixelCount(beforeFocus, afterFocus),
        `${chart.slug}: initial focus pixel delta`,
      ).toBeGreaterThanOrEqual(8);
      expect(
        changedPixelCount(beforeFocus, afterRefocus),
        `${chart.slug}: refocus pixel delta`,
      ).toBeGreaterThanOrEqual(8);
    });

    for (const mode of ['light', 'dark', 'forced-colors'] as const) {
      test(`${chart.slug}: computed SVG ring contract in ${mode}`, async ({ page }) => {
        await page.emulateMedia({
          colorScheme: mode === 'dark' ? 'dark' : 'light',
          forcedColors: mode === 'forced-colors' ? 'active' : 'none',
        });
        await page.goto(routeFor(chart), { waitUntil: 'load' });
        await page.waitForLoadState('networkidle');
        const root = await chartRoot(page, chart);
        await insertSentinelBeforeChartViewport(root, chart);
        await focusFromSentinel(page, chart);
        await assertVisibleRing(root, chart, mode === 'forced-colors');
      });
    }
  }

  test('programmatic area-chart focus updates tooltip state without rendering the keyboard ring', async ({
    page,
  }) => {
    const chart = charts[0]!;
    await page.goto(routeFor(chart), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    const root = await chartRoot(page, chart);
    const target = await focusTargetDirectly(page, chart);

    await expect(target).toHaveAttribute('aria-describedby', /-tooltip$/);
    await expect(root.locator(`.${chart.rootClass}__focus-ring-layer`)).toHaveCount(0);
    await expect(root.locator('[role="tooltip"]').first()).toContainText(chart.tooltipText);
  });

  test('tooltip does not fully cover a focused area-chart ring', async ({ page }) => {
    const chart = charts[0]!;
    await page.goto(routeFor(chart), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    const root = await chartRoot(page, chart);
    await insertSentinelBeforeChartViewport(root, chart);
    await focusFromSentinel(page, chart);
    const tooltip = root.locator('[role="tooltip"]').first();
    await expect(tooltip).toContainText(chart.tooltipText);

    const ringBox = await root.locator(primaryRingSelector(chart)).first().boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    if (!ringBox || !tooltipBox) throw new Error('Missing ring or tooltip bounds.');

    const tooltipFullyCoversRing =
      tooltipBox.x <= ringBox.x &&
      tooltipBox.y <= ringBox.y &&
      tooltipBox.x + tooltipBox.width >= ringBox.x + ringBox.width &&
      tooltipBox.y + tooltipBox.height >= ringBox.y + ringBox.height;

    expect(tooltipFullyCoversRing).toBe(false);
  });

  test('visual focus-ring layer does not intercept chart hover hit surfaces', async ({ page }) => {
    const chart = charts[1]!;
    await page.goto(routeFor(chart), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    const root = await chartRoot(page, chart);
    const target = page.locator(targetSelector(chart)).first();
    await target.scrollIntoViewIfNeeded();
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error('Missing line-chart target bounds.');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);

    await expect(root.locator(`.${chart.rootClass}__focus-ring-layer`)).toHaveCount(0);
    await expect(root.locator('[role="tooltip"]').first()).toContainText(chart.tooltipText);
    await expect(root.locator(`.${chart.hitSurfaceClass}`).first()).toBeVisible();
  });
});
