/// <reference lib="dom" />
/**
 * CIN-606 pixel probe.
 *
 * `background-clip` defaults to `border-box`, so Popover's panel border
 * always composites over its own opaque `--cinder-surface-raised`
 * background. Before this fix, the arrow's outer triangle had no background
 * of its own and painted its translucent `--cinder-border` edge straight
 * onto whatever the popover floated over instead -- invisible while both
 * tokens were opaque, real now that `--cinder-border` is 48% alpha.
 *
 * This proves the fix the only way that is actually convincing: read the
 * REAL rendered pixel color at the panel's border and at the arrow's rim,
 * with the popover floating over three different backdrop surfaces, in both
 * theme arms, and assert the two edges paint identically in every case. A
 * getComputedStyle() read would see the same `var(--cinder-border)` in both
 * places and miss the bug entirely -- the defect is in what each edge
 * composites OVER, which only a real paint (a screenshot) can show.
 *
 * HoverCard's arrow uses a different construction (`background: inherit`, a
 * filled diamond) that occludes rather than composites -- proven here by
 * showing its arrow pixel is IDENTICAL across all three backdrops, i.e. the
 * backdrop never reaches it. Tooltip has no arrow at all -- proven by
 * asserting the element doesn't exist while the tooltip is open.
 */
import { PNG } from 'pngjs';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { loadManifest, type Theme } from '../src/helpers/manifest.ts';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { THEME_STORAGE_KEY, themeContextOptions } from '../src/helpers/theme.ts';

const manifest = loadManifest();

function manifestRoute(slug: string): string {
  const entry = manifest.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error(`Missing manifest entry for "${slug}".`);
  const [path] = entry.route.split('?') as [string];
  return path;
}

type Rgb = { r: number; g: number; b: number };

async function openPage(browser: Browser, slug: string, theme: Theme): Promise<Page> {
  const context = await browser.newContext({
    ...themeContextOptions(theme),
    viewport: { width: 960, height: 720 },
    baseURL: PLAYGROUND_URL,
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
  await page.goto(`${manifestRoute(slug)}?snapshot=1`, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });
  return page;
}

/**
 * Repaints `<body>`'s own background rather than inserting a new element.
 * `<body>`'s own background/border always paints before ANY of its
 * children -- including `position: fixed` ones, which otherwise land in a
 * LATER paint bucket than ordinary in-flow content and would cover the
 * page's static content while still sitting under a portaled overlay. An
 * inline override on `<body>` itself sidesteps that whole stacking question:
 * every floating panel on the page, fixed or not, composites over it.
 */
async function setBackdropSurface(page: Page, cssVariable: string): Promise<void> {
  await page.evaluate((variable) => {
    document.body.style.backgroundColor = `var(${variable})`;
  }, cssVariable);
}

function pixelAt(png: PNG, x: number, y: number): Rgb {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    throw new Error(
      `Sample point (${x}, ${y}) is outside the captured ${png.width}x${png.height} clip.`,
    );
  }
  const index = (png.width * y + x) << 2;
  return {
    r: png.data[index] as number,
    g: png.data[index + 1] as number,
    b: png.data[index + 2] as number,
  };
}

/** Screenshots the page and reads one absolute-page-coordinate pixel. */
async function readOnePixel(page: Page, point: { x: number; y: number }): Promise<Rgb> {
  const padding = 6;
  const clip = {
    x: point.x - padding,
    y: point.y - padding,
    width: padding * 2,
    height: padding * 2,
  };
  const buffer = await page.screenshot({ clip });
  const png = PNG.sync.read(buffer);
  return pixelAt(png, Math.round(point.x - clip.x), Math.round(point.y - clip.y));
}

/** Screenshots a page-coordinate box (with padding) and returns every pixel in it. */
async function readPixelRegion(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  padding = 2,
): Promise<Rgb[]> {
  const clip = {
    x: Math.floor(box.x) - padding,
    y: Math.floor(box.y) - padding,
    width: Math.ceil(box.width) + padding * 2,
    height: Math.ceil(box.height) + padding * 2,
  };
  const buffer = await page.screenshot({ clip });
  const png = PNG.sync.read(buffer);
  const pixels: Rgb[] = [];
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      pixels.push(pixelAt(png, x, y));
    }
  }
  return pixels;
}

function channelMaxDiff(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

function expectSameColor(actual: Rgb, expected: Rgb, label: string): void {
  const tolerance = 2;
  for (const channel of ['r', 'g', 'b'] as const) {
    expect(
      Math.abs(actual[channel] - expected[channel]),
      `${label}: channel ${channel} — actual rgb(${actual.r},${actual.g},${actual.b}) vs expected rgb(${expected.r},${expected.g},${expected.b})`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

/**
 * Asserts SOME pixel in `region` reads within `tolerance` of `expected`.
 *
 * The arrow's visible rim is a genuine ~1px-wide diagonal band whose exact
 * device-pixel position depends on the trigger's (often fractional, e.g.
 * proportional-font-width-driven) layout — real, but not something a single
 * precomputed sample coordinate can hit reliably without anti-aliasing noise.
 * Scanning the whole triangle's bounding box for a close match is still a
 * real assertion about the RENDERED pixels: if the rim still composited over
 * the wrong backdrop, its color would differ from the panel border by the
 * same double-digit-per-channel margin the ticket measured, and nothing in
 * the crop would come close — anti-aliasing blends toward that same wrong
 * color, not away from it.
 */
function expectRegionContainsColor(region: readonly Rgb[], expected: Rgb, label: string): void {
  let best = Infinity;
  for (const pixel of region) best = Math.min(best, channelMaxDiff(pixel, expected));
  // The CIN-606 bug's own measured signature is a 10-31-per-channel gap (see
  // the ticket's dark/inset measurement: panel 95,124,152 vs arrow
  // 85,104,127). Real anti-aliasing residue even on the correctly-fixed
  // rendering can land a couple of pixels short of an exact match (observed
  // up to ~10) since every edge pixel of a sub-pixel-positioned diagonal
  // triangle blends toward its neighbor by some amount. 16 sits comfortably
  // above that residue and well below the bug's real margin.
  const tolerance = 16;
  expect(
    best,
    `${label}: closest pixel in the sampled region was ${best} away (per-channel max) from ` +
      `expected rgb(${expected.r},${expected.g},${expected.b})`,
  ).toBeLessThanOrEqual(tolerance);
}

const SURFACES = {
  inset: '--cinder-surface-inset',
  canvas: '--cinder-surface-canvas',
  surface: '--cinder-surface',
} as const;

async function requireBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no layout box.`);
  return box;
}

test.describe('CIN-606: Popover arrow rim composites over the same surface as the panel border', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: panel border and arrow rim read the same color on every backdrop`, async ({
      browser,
    }) => {
      const page = await openPage(browser, 'popover', theme);
      try {
        const trigger = page.getByRole('button', { name: 'Account settings' });
        await trigger.click();

        const panel = page.locator('.cinder-popover');
        await expect(panel).toHaveAttribute('data-cinder-position-ready', 'true');
        // The geometry below (arrow tip at the top of its bounding box) is
        // only correct for the default 'bottom-*' placement the basic
        // example uses — this fails loudly rather than silently sampling
        // the wrong point if that ever changes.
        await expect(panel).toHaveAttribute('data-cinder-placement', /^bottom/);

        const arrow = page.locator('.cinder-popover__arrow');
        await expect(arrow).toBeVisible();

        const panelBox = await requireBox(panel, 'popover panel');
        const arrowBox = await requireBox(arrow, 'popover arrow');

        // Panel border sample: the right edge, vertically centered — a
        // straight, unaffected-by-the-arrow edge (the arrow sits on the
        // panel's *top* edge for this placement), and a straight edge reads
        // cleanly regardless of sub-pixel layout the way the arrow's
        // diagonal rim below does not.
        const panelSample = {
          x: Math.round(panelBox.x + panelBox.width) - 1,
          y: Math.round(panelBox.y + panelBox.height / 2),
        };

        // Scan strictly INSIDE the triangle, not a padded box around it: the
        // arrow's base touches the panel's own top border exactly (this is
        // a 'bottom-*' placement), so any padding on that side would fold in
        // pixels from the panel's OWN border — which reads correctly with or
        // without the fix — and the assertion below would pass either way.
        // Trimming the bottom two rows keeps every scanned pixel inside the
        // arrow's own paint.
        const arrowScanBox = {
          x: arrowBox.x,
          y: arrowBox.y,
          width: arrowBox.width,
          height: arrowBox.height - 2,
        };

        for (const [surfaceName, cssVariable] of Object.entries(SURFACES)) {
          await setBackdropSurface(page, cssVariable);
          const panelRgb = await readOnePixel(page, panelSample);
          const arrowRegion = await readPixelRegion(page, arrowScanBox, 0);
          expectRegionContainsColor(
            arrowRegion,
            panelRgb,
            `${theme}/${surfaceName}: arrow rim vs panel border`,
          );
        }
      } finally {
        await page.context().close();
      }
    });
  }
});

test.describe('CIN-606: other CSS-triangle-arrow components', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: HoverCard's filled-diamond arrow occludes rather than composites`, async ({
      browser,
    }) => {
      const page = await openPage(browser, 'hover-card', theme);
      try {
        // The "arrow surface probe" example exposes Show/Hide buttons and
        // `arrowVisible`, so the card opens deterministically with its arrow
        // rendered instead of racing hover delays or missing the (default
        // off) arrow entirely.
        await page.getByRole('button', { name: 'Show arrow probe' }).click();

        const card = page.locator('.cinder-hover-card');
        await expect(card).toHaveAttribute('data-cinder-position-ready', 'true');

        const arrow = page.locator('.cinder-hover-card__arrow');
        await expect(arrow).toBeVisible();
        const arrowBox = await requireBox(arrow, 'hover card arrow');
        const arrowCenter = {
          x: Math.round(arrowBox.x + arrowBox.width / 2),
          y: Math.round(arrowBox.y + arrowBox.height / 2),
        };

        const readings: Rgb[] = [];
        for (const cssVariable of Object.values(SURFACES)) {
          await setBackdropSurface(page, cssVariable);
          readings.push(await readOnePixel(page, arrowCenter));
        }

        // If the arrow composited with the backdrop (the CIN-606 bug shape),
        // these three readings would differ. Occlusion means they don't.
        for (const reading of readings.slice(1)) {
          expectSameColor(
            reading,
            readings[0] as Rgb,
            `${theme}: HoverCard arrow across backdrops`,
          );
        }
      } finally {
        await page.context().close();
      }
    });

    test(`${theme}: Tooltip has no arrow element to be affected`, async ({ browser }) => {
      const page = await openPage(browser, 'tooltip', theme);
      try {
        await page.getByRole('button', { name: 'Hover me' }).hover();
        await expect(page.getByRole('tooltip')).toBeVisible();
        await expect(page.locator('.cinder-tooltip__arrow')).toHaveCount(0);
      } finally {
        await page.context().close();
      }
    });
  }
});
