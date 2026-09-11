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

// A 2x device pixel ratio, not 1x: at 1x, a ~2-CSS-px diagonal rim never
// owns a whole device pixel, so every sampled pixel is a partial-coverage
// blend and no absolute-color tolerance can both admit the correctly-fixed
// rendering and reject the bug (confirmed empirically -- the 1x version of
// this test, even split into per-edge regions, PASSED against the real
// pre-fix `origin/main` construction). At 2x the rim is ~4 device pixels
// wide with an inner pair at full, unblended strength, which is what the
// tolerances below are calibrated against.
const DEVICE_SCALE_FACTOR = 2;

async function openPage(browser: Browser, slug: string, theme: Theme): Promise<Page> {
  const context = await browser.newContext({
    ...themeContextOptions(theme),
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
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
 *
 * `?snapshot=1` mode (which every test in this file uses) wraps the whole
 * page in `.snapshot-examples`, which `component-page.svelte` gives its OWN
 * explicit opaque background -- a deliberate choice so translucent
 * component fills always composite over the same white/canvas surface the
 * committed baselines were captured against. That's exactly what makes it
 * invisible to a body-only repaint: `.snapshot-examples` sits in front of
 * `<body>` at every coordinate the Popover/HoverCard trigger occupies, so
 * without this second override every "backdrop" in this file would
 * silently be the same opaque snapshot surface regardless of which CSS
 * variable was requested -- discovered via code review, then confirmed by
 * the `backdropReadings` pairwise-difference check in the Popover parity
 * test below, which fails without this line.
 */
async function setBackdropSurface(page: Page, cssVariable: string): Promise<void> {
  await page.evaluate((variable) => {
    const snapshotExamples = document.querySelector<HTMLElement>('.snapshot-examples');
    if (snapshotExamples) snapshotExamples.style.backgroundColor = `var(${variable})`;
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

/**
 * Screenshots the page and reads one absolute-page-coordinate (CSS-pixel)
 * pixel. `page.screenshot({ clip })` takes `clip` in CSS pixels but returns
 * an image at device-pixel resolution, so at `DEVICE_SCALE_FACTOR: 2` the
 * PNG is 2x the clip's width/height -- the index into it must scale by the
 * same factor.
 */
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
  return pixelAt(
    png,
    Math.round((point.x - clip.x) * DEVICE_SCALE_FACTOR),
    Math.round((point.y - clip.y) * DEVICE_SCALE_FACTOR),
  );
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
 * The smallest per-channel max-diff between any pixel in `region` and
 * `expected`.
 *
 * The arrow's visible rim is a genuine device-pixel-wide diagonal band whose
 * exact position depends on the trigger's (often fractional, e.g.
 * proportional-font-width-driven) layout — real, but not something a single
 * precomputed sample coordinate can hit reliably without anti-aliasing
 * noise, so this scans the whole candidate region for the closest match
 * rather than reading one point.
 */
function closestChannelDiff(region: readonly Rgb[], expected: Rgb): number {
  let best = Infinity;
  for (const pixel of region) best = Math.min(best, channelMaxDiff(pixel, expected));
  return best;
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
        //
        // Split into LEFT and RIGHT halves and require the rim color in
        // BOTH independently, rather than scanning the whole triangle as
        // one region. A single region that spans the full width is exactly
        // as wide as the outer triangle, but the repeated `::before`
        // triangle that paints the rim is also that same width — an 8px
        // horizontal misplacement of `::before` (e.g. `left: 0` instead of
        // `-8px`, forgetting the padding-edge inset a zero-size parent's
        // border puts between its own border-box and its pseudo-elements'
        // containing block) still leaves HALF of it inside a whole-triangle
        // scan, so a "closest pixel anywhere in the region" check passes
        // regardless. Two half-width regions each isolate one slanted edge:
        // that same 8px shift empties one half of the rim color entirely
        // (proven by reverting to `left: 0`/`top: 0` and re-running this
        // spec, which the previous whole-region version did not catch).
        const arrowScanBoxLeft = {
          x: arrowBox.x,
          y: arrowBox.y,
          width: arrowBox.width / 2,
          height: arrowBox.height - 2,
        };
        const arrowScanBoxRight = {
          x: arrowBox.x + arrowBox.width / 2,
          y: arrowBox.y,
          width: arrowBox.width / 2,
          height: arrowBox.height - 2,
        };

        // A point clearly outside the panel, on the page's own backdrop --
        // proves `setBackdropSurface` actually reached the paint layer the
        // popover composites over. Without this, a harness bug that leaves
        // some occluding layer unpainted (exactly the `.snapshot-examples`
        // bug this file's `setBackdropSurface` comment describes) would
        // silently test the same one backdrop three times and still pass.
        const backdropSample = {
          x: Math.round(panelBox.x + panelBox.width) + 20,
          y: panelSample.y,
        };
        const backdropReadings: Rgb[] = [];
        const panelRgbs: Record<string, Rgb> = {};
        const leftGaps: Record<string, number> = {};
        const rightGaps: Record<string, number> = {};

        for (const [surfaceName, cssVariable] of Object.entries(SURFACES)) {
          await setBackdropSurface(page, cssVariable);
          const panelRgb = await readOnePixel(page, panelSample);
          panelRgbs[surfaceName] = panelRgb;
          backdropReadings.push(await readOnePixel(page, backdropSample));
          const leftRegion = await readPixelRegion(page, arrowScanBoxLeft, 0);
          const rightRegion = await readPixelRegion(page, arrowScanBoxRight, 0);
          leftGaps[surfaceName] = closestChannelDiff(leftRegion, panelRgb);
          rightGaps[surfaceName] = closestChannelDiff(rightRegion, panelRgb);
        }

        // Two checks per half, not one: an absolute ceiling AND
        // cross-backdrop stability.
        //
        // At `deviceScaleFactor: 1`, this rim (a ~2-CSS-px-wide diagonal
        // band) never owns a whole device pixel, so every sampled pixel is
        // a partial-coverage blend and no absolute tolerance can admit the
        // correctly-fixed rendering while still rejecting the bug --
        // confirmed empirically: at 1x, this exact split-region assertion
        // PASSED against the real pre-fix `origin/main` construction (`git
        // diff origin/main -- popover.css`, reverted and re-run). At
        // `deviceScaleFactor: 2` (set on `openPage`'s context), the rim is
        // wide enough to have an interior at FULL, unblended strength --
        // measured at an exact 0-per-channel gap to `panelRgb`, in both
        // arms, on every surface, with the CSS fix applied. 5 leaves a
        // small margin for anti-aliasing noise across environments without
        // reopening the 1x false-pass.
        //
        // A correctly-composited rim also shouldn't change with the page
        // backdrop: it composites against the arrow's own opaque border in
        // every case, so its distance from panelRgb should stay flat across
        // the three surfaces. Under the bug (a 'left: 0'/'top: 0' revert),
        // the RIM ITSELF shifts 8px out of the scanned half, so that half's
        // closest match becomes whatever opaque `surface-raised` pixels are
        // left -- far outside the ceiling below regardless of backdrop
        // (proven the same way as the split-region change itself: revert
        // the four offsets and re-run this spec).
        const ABSOLUTE_CEILING = 5;
        const STABILITY_TOLERANCE = 5;
        for (const [label, gaps] of [
          ['left edge', leftGaps],
          ['right edge', rightGaps],
        ] as const) {
          const values = Object.values(gaps);
          for (const [surfaceName, gap] of Object.entries(gaps)) {
            const panelRgb = panelRgbs[surfaceName] as Rgb;
            expect(
              gap,
              `${theme}/${surfaceName}: arrow rim (${label}) closest pixel was ${gap} away ` +
                `(per-channel max) from panel border rgb(${panelRgb.r},${panelRgb.g},${panelRgb.b}) ` +
                `-- above the ${ABSOLUTE_CEILING} ceiling`,
            ).toBeLessThanOrEqual(ABSOLUTE_CEILING);
          }
          const spread = Math.max(...values) - Math.min(...values);
          expect(
            spread,
            `${theme}: arrow rim (${label}) distance from the panel border varies by ${spread} ` +
              `across backdrops (${JSON.stringify(gaps)}) -- should be backdrop-independent`,
          ).toBeLessThanOrEqual(STABILITY_TOLERANCE);
        }

        // Assert the three requested backdrops actually painted three
        // different colors -- see the `setBackdropSurface` doc comment
        // above for what this catches.
        for (let i = 0; i < backdropReadings.length; i += 1) {
          for (let j = i + 1; j < backdropReadings.length; j += 1) {
            const a = backdropReadings[i] as Rgb;
            const b = backdropReadings[j] as Rgb;
            expect(
              channelMaxDiff(a, b),
              `${theme}: backdrop sample didn't change between surfaces ${i} and ${j} ` +
                `(rgb(${a.r},${a.g},${a.b}) vs rgb(${b.r},${b.g},${b.b})) -- setBackdropSurface ` +
                `isn't reaching the layer the popover actually composites over`,
            ).toBeGreaterThan(2);
          }
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
        // The sample point below (upper quarter of the arrow's bounding
        // box) is only the EXPOSED half for the default 'bottom-*'
        // placement the probe example uses — fails loudly rather than
        // silently sampling the panel-covered half if that ever changes.
        await expect(card).toHaveAttribute('data-cinder-placement', /^bottom/);

        const arrow = page.locator('.cinder-hover-card__arrow');
        await expect(arrow).toBeVisible();
        const arrowBox = await requireBox(arrow, 'hover card arrow');
        // hover-card.css centers the un-rotated square ON the panel edge
        // (`top: -0.3125rem` = `-size / 2`), so the rotated diamond's
        // GEOMETRIC CENTER -- and therefore `arrowBox`'s center, since
        // `boundingBox()` reflects the rotated box -- sits exactly on that
        // edge. A pixel sampled there can read the panel's own opaque fill
        // underneath rather than the arrow's own paint, which would pass
        // this test even with `background: inherit` removed. Sampling in
        // the upper quarter of the bounding box instead lands solidly
        // inside the corner that pokes OUT past the panel (the only part of
        // the diamond this test can actually attribute to the arrow).
        const arrowSample = {
          x: Math.round(arrowBox.x + arrowBox.width / 2),
          y: Math.round(arrowBox.y + arrowBox.height / 4),
        };

        const readings: Rgb[] = [];
        for (const cssVariable of Object.values(SURFACES)) {
          await setBackdropSurface(page, cssVariable);
          readings.push(await readOnePixel(page, arrowSample));
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
