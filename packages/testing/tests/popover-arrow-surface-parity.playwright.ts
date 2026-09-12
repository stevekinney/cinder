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
  // If anything below throws -- a bad manifest route, a load regression, the
  // `#app > *` selector never appearing -- this context would otherwise leak:
  // nothing else in the file closes a context that never made it into a
  // test's own `try`/`finally`. That leaked context (and its page, tab, and
  // renderer process) outlives the failed test, so a run with several
  // navigation failures accumulates open contexts across retries, making
  // unrelated Playwright specs slower and flakier for resource contention.
  // Close it on any failure here and rethrow so the caller still sees the
  // original error.
  try {
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
  } catch (error) {
    await context.close();
    throw error;
  }
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

/** A sampled pixel plus its page-CSS-pixel coordinates, for geometric filtering. */
type PositionedRgb = Rgb & { x: number; y: number };

/**
 * Screenshots a page-coordinate box (with padding) and returns every pixel in
 * it, tagged with its page (CSS-pixel) coordinates -- callers that need to
 * exclude pixels outside a specific sub-shape (e.g. a diagonal triangle edge)
 * can't do that from color alone, since an occluding opaque fill can paint a
 * color close enough to the target to pass a closest-match check by
 * coincidence (see the `arrowScanBox*` callers below).
 */
async function readPixelRegion(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  padding = 2,
): Promise<PositionedRgb[]> {
  const clip = {
    x: Math.floor(box.x) - padding,
    y: Math.floor(box.y) - padding,
    width: Math.ceil(box.width) + padding * 2,
    height: Math.ceil(box.height) + padding * 2,
  };
  const buffer = await page.screenshot({ clip });
  const png = PNG.sync.read(buffer);
  const pixels: PositionedRgb[] = [];
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const { r, g, b } = pixelAt(png, x, y);
      pixels.push({
        r,
        g,
        b,
        x: clip.x + x / DEVICE_SCALE_FACTOR,
        y: clip.y + y / DEVICE_SCALE_FACTOR,
      });
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
        //
        // This does NOT read one precomputed coordinate (`Math.round(right)
        // - 1`, the previous version, or a naive `right - 0.5` "border
        // center"). Chromium snaps thin (1px) borders to the device pixel
        // grid for crisp rendering, and that snap can shift the VISUAL edge
        // by up to ~1 CSS px from where `panelBox`'s sub-pixel LAYOUT
        // geometry says it should be -- confirmed empirically here: for one
        // captured panel whose fractional `right` was `x.328`, the actual
        // rendered border ink sat at roughly `[x - 1.6, x - 0.6]`, not the
        // `[x - 1, x]` the box model predicts, so no formula computed from
        // `panelBox` alone reliably lands inside a 1px border.
        //
        // Instead, scan a small window around the expected edge and pick
        // the pixel that differs most from the panel's own INTERIOR fill,
        // which -- unlike the border -- IS reliably locatable: the panel
        // always paints its own fixed, opaque `surface-raised` background
        // under its border, regardless of what the page composites behind
        // it. The border ink is a high-alpha, low-lightness-shift color
        // against that fill in this design system; the box-shadow/backdrop
        // gradient just outside the border is comparatively subtle. "Most
        // different from the interior" reliably lands on the border ink
        // rather than the fill or the exterior -- checked below against
        // `MIN_BORDER_VS_INTERIOR_DIFF` so a future retune that shrinks
        // that contrast fails loudly instead of silently sampling the wrong
        // pixel.
        const panelMidY = Math.round(panelBox.y + panelBox.height / 2);
        const panelInteriorSample = { x: panelBox.x + panelBox.width - 8, y: panelMidY };
        const panelBorderScanBox = {
          x: panelBox.x + panelBox.width - 3,
          y: panelMidY - 3,
          width: 6,
          height: 6,
        };
        const panelInteriorRgb = await readOnePixel(page, panelInteriorSample);
        const MIN_BORDER_VS_INTERIOR_DIFF = 15;

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

        // The scan above still isn't enough on its own: the OPAQUE inner
        // triangle (`::after` in popover.css — 1px smaller on every side
        // than the outer triangle this element's own border draws, offset
        // by `left: -7px`/`top: 1px` instead of the outer triangle's
        // `left: -8px`/`top: 0`) sits inside that same box, and its
        // `surface-raised` fill can read close enough to `panelRgb` to pass
        // a "closest pixel anywhere in the box" check whether or not the
        // RIM itself (the translucent `::before` layer) composites
        // correctly — reverting the CIN-606 CSS fix and re-running this
        // spec against an unfiltered scan confirmed exactly that false
        // pass. The rim is always exactly the outermost 1 CSS px of the
        // outer triangle's diagonal edge (outer half-width == inner
        // half-width + 1 at every row below the inner triangle's `top: 1px`
        // start), so classify every sampled pixel by that geometry and keep
        // only the ones on the rim, split by which slanted edge they're on
        // — the same left/right independence the previous half-box split
        // was for (an 8px horizontal `::before` misplacement empties one
        // side's rim only; scanning both edges independently still catches
        // that).
        const INNER_TOP = 1; // matches `::after`'s `top: 1px` in popover.css
        function arrowRimSide(localX: number, localY: number): 'left' | 'right' | null {
          const apex = arrowBox.width / 2;
          const outerLeftEdge = apex - localY;
          const outerRightEdge = apex + localY;
          if (localX < outerLeftEdge || localX > outerRightEdge) return null; // outside the outer triangle
          if (localY < INNER_TOP) return localX < apex ? 'left' : 'right'; // above the inner triangle's own top: all rim
          const innerY = localY - INNER_TOP;
          const innerLeftEdge = apex - innerY;
          const innerRightEdge = apex + innerY;
          if (localX < innerLeftEdge) return 'left';
          if (localX > innerRightEdge) return 'right';
          return null; // inside the opaque inner triangle
        }

        // A point clearly outside the panel, on the page's own backdrop --
        // proves `setBackdropSurface` actually reached the paint layer the
        // popover composites over. Without this, a harness bug that leaves
        // some occluding layer unpainted (exactly the `.snapshot-examples`
        // bug this file's `setBackdropSurface` comment describes) would
        // silently test the same one backdrop three times and still pass.
        const backdropSample = {
          x: Math.round(panelBox.x + panelBox.width) + 20,
          y: panelMidY,
        };
        const backdropReadings: Rgb[] = [];
        const panelRgbs: Record<string, Rgb> = {};
        const leftGaps: Record<string, number> = {};
        const rightGaps: Record<string, number> = {};

        for (const [surfaceName, cssVariable] of Object.entries(SURFACES)) {
          await setBackdropSurface(page, cssVariable);
          const borderRegion = await readPixelRegion(page, panelBorderScanBox, 0);
          let panelRgb = borderRegion[0]!;
          let borderVsInteriorDiff = -1;
          for (const pixel of borderRegion) {
            const diff = channelMaxDiff(pixel, panelInteriorRgb);
            if (diff > borderVsInteriorDiff) {
              borderVsInteriorDiff = diff;
              panelRgb = pixel;
            }
          }
          expect(
            borderVsInteriorDiff,
            `${theme}/${surfaceName}: no pixel near the panel's right edge differs from its own ` +
              `interior fill (rgb(${panelInteriorRgb.r},${panelInteriorRgb.g},${panelInteriorRgb.b})) ` +
              `by more than ${MIN_BORDER_VS_INTERIOR_DIFF} -- the border-locating scan didn't find ` +
              `real border ink, so \`panelRgb\` below can't be trusted.`,
          ).toBeGreaterThan(MIN_BORDER_VS_INTERIOR_DIFF);
          panelRgbs[surfaceName] = panelRgb;
          backdropReadings.push(await readOnePixel(page, backdropSample));
          const region = await readPixelRegion(page, arrowScanBox, 0);
          const leftRim = region.filter(
            (pixel) => arrowRimSide(pixel.x - arrowBox.x, pixel.y - arrowBox.y) === 'left',
          );
          const rightRim = region.filter(
            (pixel) => arrowRimSide(pixel.x - arrowBox.x, pixel.y - arrowBox.y) === 'right',
          );
          if (leftRim.length === 0 || rightRim.length === 0) {
            throw new Error(
              `${theme}/${surfaceName}: rim geometry filter matched no pixels ` +
                `(left=${leftRim.length}, right=${rightRim.length}) -- arrow geometry ` +
                `assumptions in this test may be stale relative to popover.css.`,
            );
          }
          leftGaps[surfaceName] = closestChannelDiff(leftRim, panelRgb);
          rightGaps[surfaceName] = closestChannelDiff(rightRim, panelRgb);
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
